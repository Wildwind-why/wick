/**
 * hero.js — the ember field.
 *
 * A live trace of a link that is mostly gone: a few dozen horizontal scans,
 * one warm light behind them, and nothing else. It is deliberately the most
 * expensive thing on the page, which is why 1% mode cuts it by two thirds and
 * the frame-time readout in the corner proves it.
 */

import { $, prefersReducedMotion } from "./dom.js";
import { onState, state, measureCurrent, codecContext } from "./state.js";
import { compare } from "../core/budget.js";
import { nf } from "./i18n.js";
import { getMode } from "./settings.js";

const QUALITY = {
  full: { lines: 26, points: 92, glow: true, stride: 1 },
  eco: { lines: 8, points: 30, glow: false, stride: 3 },
};

export function initHero() {
  const canvas = $("#hero-ember");
  if (canvas) startEmber(canvas);
  wireReadouts();
}

function startEmber(canvas) {
  const ctx = canvas.getContext("2d", { alpha: true });
  if (!ctx) return;

  let width = 0;
  let height = 0;
  let dpr = 1;
  let phase = 0;
  let frame = 0;
  const reduced =
    prefersReducedMotion() || document.documentElement.dataset.still === "1";

  const wave = (x, line, time) => {
    const a = Math.sin(x * 2.1 + time * 0.6 + line * 0.31);
    const b = Math.sin(x * 5.7 - time * 0.9 + line * 0.17) * 0.45;
    const c = Math.sin(x * 11.3 + time * 1.35) * 0.16;
    const envelope = Math.exp(-Math.pow((line - 12) / 11, 2));
    return (a + b + c) * envelope;
  };

  const draw = (time) => {
    const q = QUALITY[getMode()] || QUALITY.full;
    ctx.clearRect(0, 0, width, height);

    // the light behind everything: one warm source, low and centred
    if (q.glow) {
      const glow = ctx.createRadialGradient(
        width * 0.5,
        height * 0.72,
        0,
        width * 0.5,
        height * 0.72,
        width * 0.62,
      );
      glow.addColorStop(0, "rgba(255,122,51,0.20)");
      glow.addColorStop(0.45, "rgba(255,122,51,0.05)");
      glow.addColorStop(1, "rgba(255,122,51,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, width, height);
    }

    const gap = height / (q.lines + 1);
    ctx.lineWidth = 1;

    for (let line = 0; line < q.lines; line++) {
      const y = gap * (line + 1);
      const t01 = time * 0.55;
      const alpha = 0.05 + 0.4 * Math.exp(-Math.pow((line - q.lines / 2) / (q.lines / 2), 2));
      const warmth = Math.max(0, 1 - Math.abs(line - q.lines * 0.58) / (q.lines * 0.5));

      ctx.beginPath();
      for (let i = 0; i <= q.points; i += 1) {
        const x = (i / q.points) * width;
        const amplitude = wave(x / width, line, t01) * gap * 0.5;
        const px = x;
        const py = y + amplitude;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.strokeStyle = `rgba(${Math.round(255 * (0.55 + 0.45 * warmth))},${Math.round(
        170 - 60 * warmth,
      )},${Math.round(120 - 60 * warmth)},${alpha.toFixed(3)})`;
      ctx.stroke();
    }

    // the wick itself: a short vertical light at the centre line
    const cx = width * 0.5;
    const cy = height * 0.62;
    const flicker = 0.82 + 0.18 * Math.sin(time * 3.1) * Math.sin(time * 0.7);
    const shaft = ctx.createLinearGradient(cx, cy - 46, cx, cy + 10);
    shaft.addColorStop(0, "rgba(255,184,119,0)");
    shaft.addColorStop(0.55, `rgba(255,150,80,${(0.5 * flicker).toFixed(3)})`);
    shaft.addColorStop(1, `rgba(255,122,51,${(0.9 * flicker).toFixed(3)})`);
    ctx.fillStyle = shaft;
    ctx.fillRect(cx - 0.75, cy - 46, 1.5, 56);
    ctx.beginPath();
    ctx.arc(cx, cy + 8, 1.6, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,200,150,${(0.9 * flicker).toFixed(3)})`;
    ctx.fill();
  };

  /**
   * Resizing a canvas wipes it, so a static render has to be repainted by
   * hand. (This is also why the harness's repeated resize events used to leave
   * an empty card.)
   */
  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    dpr = Math.min(2, window.devicePixelRatio || 1);
    width = Math.max(1, Math.round(rect.width || canvas.width / dpr || 520));
    height = Math.max(1, Math.round(rect.height || canvas.height / dpr || 360));
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (reduced) draw(phase);
  };
  resize();
  window.addEventListener("resize", resize, { passive: true });
  if (typeof ResizeObserver !== "undefined") {
    new ResizeObserver(resize).observe(canvas);
  }

  if (reduced) return;

  const loop = () => {
    frame += 1;
    const q = QUALITY[getMode()] || QUALITY.full;
    if (frame % q.stride === 0) {
      phase += 0.016 * q.stride;
      draw(phase);
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);

  document.addEventListener("wick:mode", () => {
    frame = 0;
    resize();
    draw(phase);
  });
}

/** The hero numbers come from the same engines as everything else. */
function wireReadouts() {
  const bytesEl = $("#hero-bytes");
  const msgsEl = $("#hero-msgs");

  const update = () => {
    const measurement = measureCurrent();
    if (bytesEl) bytesEl.textContent = nf(measurement.size);
    if (msgsEl) {
      const result = compare({
        message: state.message,
        context: codecContext(),
        radioId: "lte",
        resourceId: "phone",
        levelPct: 1,
        batchSize: 1,
        eco: false,
      });
      msgsEl.textContent = nf(result.wick.sim.messages);
    }
  };
  update();
  onState(update);
}
