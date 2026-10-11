/**
 * sim.worker.js — the scenario model.
 *
 * Two runs of up to 20 000 simulated minutes each. That is not much work, but
 * it is work that would land in the middle of a scroll if it ran on the main
 * thread, and a page about spending resources carefully has no excuse for
 * dropping frames while it does arithmetic.
 */

import { run } from "../core/sim.js";

self.addEventListener("message", (event) => {
  const { id, scenario, bytes, naiveBytes } = event.data || {};
  const started = performance.now();
  const wick = run(scenario, { mode: "wick", bytes, naiveBytes });
  const naive = run(scenario, { mode: "naive", bytes, naiveBytes });
  self.postMessage({ id, wick, naive, ms: performance.now() - started });
});
