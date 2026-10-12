/**
 * main.js — the boot sequence.
 *
 * One page, seven sections, thirteen modules. Each section is mounted
 * independently: if one of them cannot start, the rest of the page still
 * works and the failure is recorded rather than thrown at the visitor.
 *
 * Order matters in exactly two places. Settings go first, because they decide
 * the language table and the mode before anything is painted; and the shared
 * state model is fed by the bench before the budget lab reads it, so the
 * number under the slider is the number you just typed.
 *
 * `src/core/*` stays free of the DOM so it can run in a worker and in the
 * test pages; this file is the only place that knows the page exists.
 */

import { initSettings } from "./ui/settings.js";
import { workerUnsupportedReason } from "./ui/dom.js";
import { initReveal } from "./ui/reveal.js";
import { initTelemetry } from "./ui/telemetry.js";
import { initHero } from "./ui/hero.js";
import { initCost } from "./ui/cost.js";
import { initBench } from "./ui/bench.js";
import { initSeal } from "./ui/seal.js";
import { initLab } from "./ui/lab.js";
import { initField } from "./ui/field.js";
import { initShareCard } from "./ui/sharecard.js";
import { initTour } from "./ui/tour.js";
import { initOffline } from "./ui/offline.js";
import { initImpact } from "./ui/impact.js";
import { initCraft } from "./ui/craft.js";

/** Failures are kept on the page (and on `wick:ready`) instead of in console. */
const failures = [];

function mount(name, fn) {
  try {
    const result = fn();
    if (result && typeof result.then === "function") {
      return result.then(
        () => true,
        (error) => record(name, error),
      );
    }
    return true;
  } catch (error) {
    return record(name, error);
  }
}

function record(name, error) {
  failures.push({ name, message: String((error && error.message) || error) });
  return false;
}

/** A module that never settles must not hold the page hostage. */
function mountWithin(fn, ms) {
  return Promise.race([
    Promise.resolve().then(fn),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`did not settle within ${ms}ms`)), ms),
    ),
  ]);
}

/**
 * Register the offline shell.
 *
 * This is the one thing that makes "open the folder offline and it still runs"
 * true, and it belongs in the entry point rather than in a section module: the
 * shell has to be cached whether or not the visitor ever scrolls to section 04.
 *
 * It is also the piece that was missing. `sw.js` existed, was listed in its own
 * precache manifest, and was described in the README as active — but no file
 * ever called `register()`, so the worker was never installed and the cache was
 * never populated. Section 04 meanwhile printed "active · shell cached" because
 * it trusted `navigator.serviceWorker.ready`, which does not reject when there
 * is nothing to be ready for.
 *
 * Registration is best-effort and never blocks the page: on `file://` there is
 * no secure context to register into, and that is a legitimate way to open this
 * project.
 */
let shellError = null;

function registerOfflineShell() {
  const reason = workerUnsupportedReason();
  if (reason) return reason;

  try {
    navigator.serviceWorker.register("sw.js", { scope: "./" }).catch((error) => {
      // Not a module failure: the shell is optional, section 04 reports its
      // real state, and a document written with `document.write` inherits a
      // valid-looking URL while being unable to host a worker at all. Kept on
      // the manifest so it is visible rather than silent.
      shellError = String((error && error.message) || error);
    });
  } catch (error) {
    return `register-threw:${String((error && error.message) || error)}`;
  }
  return "registering";
}

/* 1. mode + language first: they decide the copy and the budget before
      anything else is painted. */
await mount("settings", initSettings);

/* 2. Everything that only reads state is mounted together. The modules are
      independent by design — each one owns one section and listens for the
      two custom events instead of calling into its neighbours — so there is
      no reason to make the visitor wait for them one after another. They are
      invoked in page order inside `Promise.all`, so the shared model is
      seeded in the order a reader meets it. */
await Promise.all([
  mount("reveal", initReveal),
  mount("telemetry", initTelemetry),
  mount("hero", initHero),
  mount("cost", initCost),
  mount("bench", initBench),
  mount("seal", initSeal),
  mount("lab", initLab),
  mount("field", initField),
  mount("sharecard", initShareCard),
  mount("tour", initTour),
  mount("impact", initImpact),
  mount("craft", initCraft),
].map((pending) => pending));

/* 3. The offline shell: registered before the outbox looks at it, so section 04
      reports a real worker rather than a hopeful one. */
const shellRegistration = registerOfflineShell();

/* 4. The offline outbox is the only module that touches storage, and storage
      is the only thing here that can be slow, blocked or absent. It runs last
      and is bounded, so a hanging IndexedDB costs the visitor the outbox —
      never the six sections above it. */
const CAPTURE_BOOT = location.search.includes("capture=1");
await mount("offline", () => mountWithin(initOffline, CAPTURE_BOOT ? 60000 : 8000));

// Getters, not captured values: registration settles after the boot sequence
// finishes, and a snapshot would report the state of the page at mount time
// rather than the state of the page now.
window.__wick = {
  version: "2.1",
  get failures() {
    return failures;
  },
  get shell() {
    return shellRegistration;
  },
  get shellError() {
    return shellError;
  },
  get ok() {
    return failures.length === 0;
  },
};

document.dispatchEvent(
  new CustomEvent("wick:ready", { detail: { failures: failures.length } }),
);
