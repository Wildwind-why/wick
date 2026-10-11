/**
 * sharecard.js — section 05's export.
 *
 * Pressing the button draws the result you are looking at onto a canvas and
 * hands it to the browser as a PNG. Nothing is uploaded: the card is rendered
 * locally, from the same numbers already on screen, and there is no image
 * library involved — a 1200×630 canvas and the system font stack, which is
 * also why it works with the network unplugged.
 *
 * The card carries the word "modelled" on it. The scenario engine is a model
 * with a seeded random process, not a field trial, and a picture that travels
 * away from the page it came from has to keep saying so.
 */

import { $ } from "./dom.js";
import { t } from "./i18n.js";
import { currentFieldResult } from "./field.js";

const SIZE = { w: 1200, h: 630 };
const INK = "#08080b";
const EMBER = "#ff7a33";
const PAPER = "#ededf2";
const DIM = "#8e8e9c";

let latest = null;

export function initShareCard() {
  const button = $("#field-share");
  const out = $("#field-share-out");
  if (!button) return;

  document.addEventListener("wick:field", (event) => {
    latest = event.detail;
  });

  button.addEventListener("click", () => {
    // Section 05 paints before this module mounts, so the button has to be
    // able to ask for the current result rather than wait for the next change.
    const result = latest || currentFieldResult();
    if (!result) return;
    const canvas = draw(result);
    const link = document.createElement("a");
    link.download = `wick-${result.scenarioId}-${result.seed}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
    if (out) out.textContent = `${t("c5.share.done")} · ${SIZE.w}×${SIZE.h} · ${result.label}`;
  });
}

function draw(result) {
  const canvas = document.createElement("canvas");
  canvas.width = SIZE.w;
  canvas.height = SIZE.h;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, SIZE.w, SIZE.h);

  // One warm edge, the same ember the page uses for "energy leaving".
  ctx.fillStyle = EMBER;
  ctx.fillRect(0, 0, SIZE.w, 8);

  const M = 72;
  ctx.textBaseline = "alphabetic";

  ctx.fillStyle = DIM;
  ctx.font = '600 22px ui-monospace, "SFMono-Regular", Menlo, monospace';
  ctx.fillText("wick · 1% BATTERY", M, 96);

  ctx.fillStyle = PAPER;
  ctx.font = '500 40px ui-sans-serif, system-ui, "Helvetica Neue", sans-serif';
  ctx.fillText(result.label, M, 156);

  // The number the whole card exists for.
  ctx.fillStyle = EMBER;
  ctx.font = '700 168px ui-sans-serif, system-ui, "Helvetica Neue", sans-serif';
  ctx.fillText(`${result.ratio.toFixed(2)}×`, M - 6, 320);

  ctx.fillStyle = DIM;
  ctx.font = '600 24px ui-monospace, "SFMono-Regular", Menlo, monospace';
  ctx.fillText(t("card.delivered"), M, 364);

  const wickDelivered = result.delivered.wick.toLocaleString("en-US");
  const naiveDelivered = result.delivered.naive.toLocaleString("en-US");
  ctx.fillStyle = PAPER;
  ctx.font = '700 44px ui-monospace, "SFMono-Regular", Menlo, monospace';
  ctx.fillText(wickDelivered, M, 424);
  const wickWidth = ctx.measureText(wickDelivered).width;
  ctx.fillStyle = DIM;
  ctx.font = '400 30px ui-monospace, "SFMono-Regular", Menlo, monospace';
  ctx.fillText(` vs ${naiveDelivered}`, M + wickWidth, 424);

  ctx.fillStyle = DIM;
  ctx.font = '600 24px ui-monospace, "SFMono-Regular", Menlo, monospace';
  ctx.fillText(t("card.hours"), M, 476);

  ctx.fillStyle = PAPER;
  ctx.font = '700 36px ui-monospace, "SFMono-Regular", Menlo, monospace';
  ctx.fillText(
    `${Math.round(result.alive.wick)} h  vs  ${Math.round(result.alive.naive)} h`,
    M,
    522,
  );

  // Three horizontal rules as a small chart motif: the ratio, drawn to scale.
  const barW = 260;
  const max = Math.max(result.delivered.wick, result.delivered.naive, 1);
  const bars = [
    { value: result.delivered.wick, color: EMBER, y: 200 },
    { value: result.delivered.naive, color: "rgba(142,142,156,0.55)", y: 224 },
  ];
  for (const bar of bars) {
    ctx.fillStyle = bar.color;
    ctx.fillRect(SIZE.w - M - barW, bar.y, Math.max(3, (bar.value / max) * barW), 10);
  }

  ctx.fillStyle = DIM;
  ctx.font = '400 21px ui-sans-serif, system-ui, sans-serif';
  ctx.fillText(t("card.modelled", { hours: result.hours, seed: result.seed }), M, 578);

  ctx.fillStyle = "rgba(142,142,156,0.5)";
  ctx.font = '600 20px ui-monospace, "SFMono-Regular", Menlo, monospace';
  ctx.fillText("1% BATTERY — HOW FAR CAN IT GO?", SIZE.w - M - 372, 578);

  return canvas;
}
