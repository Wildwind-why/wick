/**
 * telemetry.js — the instrument panel.
 *
 * Four live numbers, and one of them is about this page rather than the
 * product: the median time between frames. It is here so that the 1% mode
 * claim is falsifiable — turn the mode on, watch the number move.
 */

import { $, rafThrottle } from "./dom.js";
import { t, nf } from "./i18n.js";
import { onState, state } from "./state.js";

let frameSamples = [];
let lastFrame = 0;
let medianMs = 0;

export function initTelemetry() {
  const railFill = $("#rail-fill");
  const railLabel = $("#rail-label");
  const topbar = $("#topbar");
  const chargeEl = $("#tel-charge");
  const battEl = $("#tel-batt");
  const savedEl = $("#tel-saved");
  const frameEl = $("#tel-frame");
  const linkEl = $("#tel-link");
  const dotEl = $("#tel-dot");

  /* ---- the page's own charge = how far down the story you are ---------- */
  const onScroll = rafThrottle(() => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const progress = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
    // 100% at the hero, 1% at the foot — the story ends where the battery does.
    const charge = 100 - progress * 99;
    if (railFill) railFill.style.height = `${progress * 100}%`;
    if (railLabel) {
      railLabel.style.top = `${progress * 100}%`;
      railLabel.textContent = `${charge.toFixed(charge < 10 ? 1 : 0)}%`;
    }
    if (chargeEl) chargeEl.textContent = `${charge < 10 ? charge.toFixed(1) : Math.round(charge)}%`;
    if (battEl) {
      battEl.style.setProperty("--level", `${charge}%`);
      battEl.dataset.state = charge <= 5 ? "crit" : charge <= 25 ? "warn" : "ok";
    }
    if (topbar) topbar.classList.toggle("is-stuck", window.scrollY > 24);
  });
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll, { passive: true });
  onScroll();

  /* ---- bytes this page did not have to send ---------------------------- */
  onState((current) => {
    if (savedEl) savedEl.textContent = nf(Math.round(current.bytesSaved));
  });
  if (savedEl) savedEl.textContent = nf(Math.round(state.bytesSaved));

  /* ---- real network state --------------------------------------------- */
  const syncLink = () => {
    const online = navigator.onLine !== false;
    if (linkEl) linkEl.textContent = online ? t("tel.online") : t("tel.offline");
    if (dotEl) dotEl.dataset.state = online ? "ok" : "crit";
  };
  window.addEventListener("online", syncLink);
  window.addEventListener("offline", syncLink);
  syncLink();

  /* ---- median frame interval ------------------------------------------ */
  const sample = (now) => {
    if (lastFrame) {
      const delta = now - lastFrame;
      if (delta > 0 && delta < 600) {
        frameSamples.push(delta);
        if (frameSamples.length > 40) frameSamples.shift();
      }
    }
    lastFrame = now;
    requestAnimationFrame(sample);
  };
  requestAnimationFrame(sample);

  setInterval(() => {
    if (frameSamples.length < 4 || !frameEl) return;
    const sorted = [...frameSamples].sort((a, b) => a - b);
    const median = sorted[sorted.length >> 1];
    // Only report a move worth reporting, so the number stays readable.
    if (Math.abs(median - medianMs) > 0.6) {
      medianMs = median;
      frameEl.textContent = `${median.toFixed(1)} ms`;
      frameEl.dataset.state = median < 17 ? "ok" : median < 26 ? "warn" : "crit";
    }
  }, 1400);

}
